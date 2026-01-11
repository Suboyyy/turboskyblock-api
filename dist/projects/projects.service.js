"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const recipes_service_1 = require("../recipes/recipes.service");
const fs = require("fs");
const path = require("path");
let ProjectsService = class ProjectsService {
    constructor(recipesService) {
        this.recipesService = recipesService;
        this.dataPath = path.join(process.cwd(), 'data', 'projects.json');
        this.projects = [];
        this.loadProjects();
    }
    loadProjects() {
        try {
            if (!fs.existsSync(path.dirname(this.dataPath))) {
                fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
            }
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                this.projects = JSON.parse(data);
            }
            else {
                this.projects = [];
                this.saveProjects();
            }
        }
        catch (error) {
            this.projects = [];
        }
    }
    saveProjects() {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.projects, null, 2));
    }
    findAll() {
        return this.projects;
    }
    findOne(id) {
        return this.projects.find(p => p.id === id);
    }
    create(projectData) {
        const tree = this.recipesService.calculateBaseResources(projectData.targetRecipeId, projectData.targetQuantity, projectData.maxDepth);
        const projTree = this.convertToProjectTree(tree);
        const items = {};
        this.flattenTree(projTree, items);
        for (const item in items) {
            items[item].baseQuantity = items[item].targetQuantity;
        }
        const newProject = {
            ...projectData,
            id: Date.now().toString(),
            items,
            nodeOverrides: {},
            tree: projTree,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.projects.push(newProject);
        this.saveProjects();
        return newProject;
    }
    convertToProjectTree(node) {
        if (!node)
            return null;
        return {
            itemId: node.itemId,
            itemName: node.itemName,
            baseQuantity: node.quantity,
            quantity: node.quantity,
            currentQuantity: 0,
            isBase: !!node.isBase,
            children: (node.children || []).map((c) => this.convertToProjectTree(c)),
        };
    }
    flattenTree(node, items) {
        if (!node)
            return;
        if (!items[node.itemId]) {
            items[node.itemId] = {
                itemId: node.itemId,
                targetQuantity: 0,
                currentQuantity: 0,
                baseQuantity: 0,
            };
        }
        items[node.itemId].targetQuantity += node.quantity;
        if (typeof node.currentQuantity === 'number') {
            items[node.itemId].currentQuantity += node.currentQuantity;
        }
        if (typeof node.baseQuantity === 'number') {
            items[node.itemId].baseQuantity = Math.max(0, (items[node.itemId].baseQuantity ?? 0) + Math.max(0, node.baseQuantity));
        }
        if (node.children) {
            node.children.forEach(child => this.flattenTree(child, items));
        }
    }
    updateItemQuantity(projectId, itemId, quantity) {
        const project = this.findOne(projectId);
        if (!project)
            return null;
        if (project.items[itemId]) {
            const prev = project.items[itemId].currentQuantity;
            project.items[itemId].currentQuantity = quantity;
            const delta = quantity - prev;
            if (delta !== 0) {
                const recipe = this.recipesService.findOne(itemId);
                if (recipe && !recipe.isBase) {
                    this.adjustTargets(project, itemId, delta);
                }
            }
            project.updatedAt = new Date().toISOString();
            this.saveProjects();
        }
        return project;
    }
    updateNodeOverride(projectId, path, currentQuantity) {
        const project = this.findOne(projectId);
        if (!project)
            return null;
        this.ensureProjectTree(project);
        const node = this.findNodeByPath(project.tree, path);
        if (node && typeof currentQuantity === 'number') {
            node.currentQuantity = Math.max(0, currentQuantity);
            this.recalcSubtreeByParentPossession(node);
            this.clampPossessionToRequired(node);
            const items = {};
            this.flattenTree(project.tree, items);
            project.items = items;
            project.updatedAt = new Date().toISOString();
            this.saveProjects();
        }
        return project;
    }
    delete(id) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            this.projects.splice(index, 1);
            this.saveProjects();
            return true;
        }
        return false;
    }
    updateNodeRequired(projectId, path, quantity) {
        const project = this.findOne(projectId);
        if (!project)
            return null;
        this.ensureProjectTree(project);
        const node = this.findNodeByPath(project.tree, path);
        if (node) {
            node.quantity = Math.max(0, quantity);
            const oldChildren = node.children || [];
            const rebuilt = this.recipesService.calculateBaseResources(node.itemId, node.quantity, Infinity);
            node.isBase = !!rebuilt?.isBase;
            const rebuiltChildren = (rebuilt?.children || []).map((c) => this.convertToProjectTree(c));
            node.children = this.mergePreserveBaseline(oldChildren, rebuiltChildren);
            this.recalcSubtreeByParentPossession(node);
            const items = {};
            this.flattenTree(project.tree, items);
            project.items = items;
            project.updatedAt = new Date().toISOString();
            this.saveProjects();
        }
        return project;
    }
    recalcSubtreeByParentPossession(root) {
        const parentRecipe = this.recipesService.findOne(root.itemId);
        if (!parentRecipe || parentRecipe.isBase)
            return;
        const parentRemaining = Math.max(0, (root.quantity || 0) - (root.currentQuantity || 0));
        for (const ing of parentRecipe.ingredients || []) {
            const child = (root.children || []).find(c => c.itemId === ing.itemId);
            if (!child)
                continue;
            const childRecipe = this.recipesService.findOne(ing.itemId);
            const oldChildren = child.children || [];
            if (childRecipe?.isBase) {
                child.quantity = Math.max(0, parentRemaining * ing.quantity);
                child.currentQuantity = Math.min(Math.max(0, child.currentQuantity || 0), child.quantity);
            }
            else {
                const childOutput = childRecipe.output || 1;
                child.quantity = Math.max(0, Math.ceil((parentRemaining * ing.quantity) / childOutput));
                child.currentQuantity = Math.min(Math.max(0, child.currentQuantity || 0), child.quantity);
                const rebuilt = this.recipesService.calculateBaseResources(child.itemId, child.quantity, Infinity);
                const rebuiltChildren = (rebuilt?.children || []).map((c) => this.convertToProjectTree(c));
                child.children = this.mergePreserveBaseline(oldChildren, rebuiltChildren);
                this.clampPossessionToRequired(child);
                this.recalcSubtreeByParentPossession(child);
            }
        }
    }
    clampPossessionToRequired(node) {
        if (!node)
            return;
        const required = Math.max(0, node.quantity || 0);
        const current = Math.max(0, node.currentQuantity || 0);
        node.currentQuantity = Math.min(current, required);
        for (const ch of node.children || []) {
            this.clampPossessionToRequired(ch);
        }
    }
    mergePreserveBaseline(oldChildren, newChildren) {
        const merged = (newChildren || []).map(nc => {
            const match = (oldChildren || []).find(o => o.itemId === nc.itemId);
            if (match) {
                nc.baseQuantity = Math.max(0, match.baseQuantity || nc.baseQuantity);
                nc.currentQuantity = Math.max(0, match.currentQuantity || 0);
                nc.children = this.mergePreserveBaseline(match.children || [], nc.children || []);
            }
            return nc;
        });
        return merged;
    }
    findNodeByPath(root, path) {
        if (!root || !path || path.length === 0)
            return null;
        let curr = root;
        if (curr.itemId !== path[0])
            return null;
        for (let i = 1; i < path.length; i++) {
            const nextId = path[i];
            curr = (curr.children || []).find(c => c.itemId === nextId) || null;
            if (!curr)
                return null;
        }
        return curr;
    }
    getProgress(projectId) {
        const project = this.findOne(projectId);
        if (!project)
            return null;
        this.ensureProjectTree(project);
        return this.calculateProgressTree(project.tree);
    }
    ensureProjectTree(project) {
        if (!project.tree) {
            const base = this.recipesService.calculateBaseResources(project.targetRecipeId, project.targetQuantity, project.maxDepth);
            const tree = this.convertToProjectTree(base);
            project.tree = tree;
            const items = {};
            this.flattenTree(project.tree, items);
            project.items = items;
            project.updatedAt = new Date().toISOString();
            this.saveProjects();
        }
    }
    calculateProgressTree(node) {
        if (!node)
            return null;
        const base = Math.max(0, node.baseQuantity);
        const required = Math.max(0, node.quantity);
        const current = Math.max(0, node.currentQuantity);
        const progress = required === 0 ? 100 : Math.min(100, (((base - required) + current) / base) * 100);
        const children = (node.children || []).map(child => this.calculateProgressTree(child)).filter(Boolean);
        return {
            itemId: node.itemId,
            itemName: node.itemName,
            quantity: required,
            currentQuantity: current,
            isBase: node.isBase,
            progress: Math.round(progress * 100) / 100,
            children,
        };
    }
    adjustTargets(project, itemId, craftsDelta) {
        const recipe = this.recipesService.findOne(itemId);
        if (!recipe)
            return;
        for (const ing of recipe.ingredients || []) {
            const childRecipe = this.recipesService.findOne(ing.itemId);
            const isRefund = craftsDelta < 0;
            const absDelta = Math.abs(craftsDelta);
            if (childRecipe?.isBase) {
                const units = ing.quantity * absDelta;
                const item = project.items[ing.itemId];
                if (item) {
                    const deltaUnits = isRefund ? units : -units;
                    item.targetQuantity = Math.max(0, (item.targetQuantity ?? 0) + deltaUnits);
                }
            }
            else {
                const output = childRecipe?.output || 1;
                const childCrafts = Math.ceil((ing.quantity * absDelta) / output);
                const childItem = project.items[ing.itemId];
                if (childItem) {
                    const deltaCrafts = isRefund ? childCrafts : -childCrafts;
                    childItem.targetQuantity = Math.max(0, (childItem.targetQuantity ?? 0) + deltaCrafts);
                }
                if (childRecipe && !childRecipe.isBase && childCrafts !== 0) {
                    this.adjustTargets(project, ing.itemId, isRefund ? -childCrafts : childCrafts);
                }
            }
        }
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [recipes_service_1.RecipesService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map