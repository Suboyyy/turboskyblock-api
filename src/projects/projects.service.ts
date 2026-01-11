import { Injectable } from '@nestjs/common';
import { RecipesService } from '../recipes/recipes.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectItem {
  itemId: string;
  baseQuantity?: number;
  targetQuantity: number;
  currentQuantity: number;
}

export interface ProjectTreeNode {
  itemId: string;
  itemName: string;
  baseQuantity: number;
  quantity: number;
  currentQuantity: number;
  isBase: boolean;
  children: ProjectTreeNode[];
}

export interface Project {
  id: string;
  name: string;
  targetRecipeId: string;
  targetQuantity: number;
  maxDepth: number;
  items: Record<string, ProjectItem>;
  // Node-specific overrides keyed by path like "A/B/C"
  nodeOverrides?: Record<string, { craftsDone?: number; currentQuantityOverride?: number }>;
  tree?: ProjectTreeNode;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProjectsService {
  private readonly dataPath = path.join(process.cwd(), 'data', 'projects.json');
  private projects: Project[] = [];

  constructor(private readonly recipesService: RecipesService) {
    this.loadProjects();
  }

  private loadProjects() {
    try {
      if (!fs.existsSync(path.dirname(this.dataPath))) {
        fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
      }
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf-8');
        this.projects = JSON.parse(data);
      } else {
        this.projects = [];
        this.saveProjects();
      }
    } catch (error) {
      this.projects = [];
    }
  }

  private saveProjects() {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.projects, null, 2));
  }

  findAll(): Project[] {
    return this.projects;
  }

  findOne(id: string): Project {
    return this.projects.find(p => p.id === id);
  }

  create(projectData: Omit<Project, 'id' | 'items' | 'createdAt' | 'updatedAt' | 'tree' | 'nodeOverrides'>): Project {
    const tree = this.recipesService.calculateBaseResources(
      projectData.targetRecipeId,
      projectData.targetQuantity,
      projectData.maxDepth,
    );

    const projTree = this.convertToProjectTree(tree);
    const items: Record<string, ProjectItem> = {};
    this.flattenTree(projTree, items);

    for (const item in items) {
      items[item].baseQuantity = items[item].targetQuantity;
    }

    const newProject: Project = {
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

  private convertToProjectTree(node: any): ProjectTreeNode {
    if (!node) return null as any;
    return {
      itemId: node.itemId,
      itemName: node.itemName,
      baseQuantity: node.quantity,
      quantity: node.quantity,
      currentQuantity: 0,
      isBase: !!node.isBase,
      children: (node.children || []).map((c: any) => this.convertToProjectTree(c)),
    };
  }

  private flattenTree(node: any, items: Record<string, ProjectItem>) {
    if (!node) return;

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
      items[node.itemId].baseQuantity = Math.max(
        0,
        (items[node.itemId].baseQuantity ?? 0) + Math.max(0, node.baseQuantity)
      );
    }

    if (node.children) {
      node.children.forEach(child => this.flattenTree(child, items));
    }
  }

  updateItemQuantity(projectId: string, itemId: string, quantity: number): Project {
    const project = this.findOne(projectId);
    if (!project) return null;

    if (project.items[itemId]) {
      const prev = project.items[itemId].currentQuantity;
      project.items[itemId].currentQuantity = quantity;
      const delta = quantity - prev;

      // Cascade: when crafting non-base items, adjust required targets of prerequisites
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

  updateNodeOverride(projectId: string, path: string[], currentQuantity?: number): Project {
    const project = this.findOne(projectId);
    if (!project) return null;
    this.ensureProjectTree(project);
    const node = this.findNodeByPath(project.tree as ProjectTreeNode, path);
    if (node && typeof currentQuantity === 'number') {
      node.currentQuantity = Math.max(0, currentQuantity);
      this.recalcSubtreeByParentPossession(node);
      // Ensure possession never exceeds requirement across the subtree
      this.clampPossessionToRequired(node);
      const items: Record<string, ProjectItem> = {};
      this.flattenTree(project.tree, items);
      project.items = items;
      project.updatedAt = new Date().toISOString();
      this.saveProjects();
    }
    return project;
  }

  delete(id: string): boolean {
    const index = this.projects.findIndex(p => p.id === id);
    if (index !== -1) {
      this.projects.splice(index, 1);
      this.saveProjects();
      return true;
    }
    return false;
  }

  updateNodeRequired(projectId: string, path: string[], quantity: number): Project {
    const project = this.findOne(projectId);
    if (!project) return null;
    this.ensureProjectTree(project);
    const node = this.findNodeByPath(project.tree as ProjectTreeNode, path);
    if (node) {
      node.quantity = Math.max(0, quantity);
      // Do NOT modify baseQuantity: it is the immutable baseline
      const oldChildren = node.children || [];
      const rebuilt = this.recipesService.calculateBaseResources(node.itemId, node.quantity, Infinity);
      node.isBase = !!rebuilt?.isBase;
      const rebuiltChildren = (rebuilt?.children || []).map((c: any) => this.convertToProjectTree(c));
      node.children = this.mergePreserveBaseline(oldChildren, rebuiltChildren);
      // If parent has possession, reflect it on children requirements
      this.recalcSubtreeByParentPossession(node);
      const items: Record<string, ProjectItem> = {};
      this.flattenTree(project.tree, items);
      project.items = items;
      project.updatedAt = new Date().toISOString();
      this.saveProjects();
    }
    return project;
  }

  private recalcSubtreeByParentPossession(root: ProjectTreeNode) {
    const parentRecipe = this.recipesService.findOne(root.itemId);
    if (!parentRecipe || parentRecipe.isBase) return;
    // Parent remaining requirement: required minus possessed
    const parentRemaining = Math.max(0, (root.quantity || 0) - (root.currentQuantity || 0));

    for (const ing of parentRecipe.ingredients || []) {
      const child = (root.children || []).find(c => c.itemId === ing.itemId);
      if (!child) continue;
      const childRecipe = this.recipesService.findOne(ing.itemId);
      const oldChildren = child.children || [];
      if (childRecipe?.isBase) {
        // Base child: units required = parentRemaining * units per parent
        child.quantity = Math.max(0, parentRemaining * ing.quantity);
        child.currentQuantity = Math.min(Math.max(0, child.currentQuantity || 0), child.quantity);
        // base items have no children
      } else {
        const childOutput = childRecipe.output || 1;
        // Non-base child: crafts required = ceil((parentRemaining * ing.quantity) / childOutput)
        child.quantity = Math.max(0, Math.ceil((parentRemaining * ing.quantity) / childOutput));
        child.currentQuantity = Math.min(Math.max(0, child.currentQuantity || 0), child.quantity);
        // rebuild child subtree from recipes based on new crafts count
        const rebuilt = this.recipesService.calculateBaseResources(child.itemId, child.quantity, Infinity);
        const rebuiltChildren = (rebuilt?.children || []).map((c: any) => this.convertToProjectTree(c));
        child.children = this.mergePreserveBaseline(oldChildren, rebuiltChildren);
        // Clamp grandchildren possession to their updated requirements
        this.clampPossessionToRequired(child);
        // Recursively apply possession effect down the subtree
        this.recalcSubtreeByParentPossession(child);
      }
    }
  }

  private clampPossessionToRequired(node: ProjectTreeNode | null | undefined) {
    if (!node) return;
    const required = Math.max(0, node.quantity || 0);
    const current = Math.max(0, node.currentQuantity || 0);
    node.currentQuantity = Math.min(current, required);
    for (const ch of node.children || []) {
      this.clampPossessionToRequired(ch);
    }
  }

  private mergePreserveBaseline(oldChildren: ProjectTreeNode[], newChildren: ProjectTreeNode[]): ProjectTreeNode[] {
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

  private findNodeByPath(root: ProjectTreeNode, path: string[]): ProjectTreeNode | null {
    if (!root || !path || path.length === 0) return null;
    let curr: ProjectTreeNode | null = root;
    if (curr.itemId !== path[0]) return null;
    for (let i = 1; i < path.length; i++) {
      const nextId = path[i];
      curr = (curr.children || []).find(c => c.itemId === nextId) || null;
      if (!curr) return null;
    }
    return curr;
  }
  getProgress(projectId: string): any {
    const project = this.findOne(projectId);
    if (!project) return null;
    this.ensureProjectTree(project);
    return this.calculateProgressTree(project.tree as ProjectTreeNode);
  }

  private ensureProjectTree(project: Project) {
    if (!project.tree) {
      const base = this.recipesService.calculateBaseResources(
        project.targetRecipeId,
        project.targetQuantity,
        project.maxDepth,
      );
      const tree = this.convertToProjectTree(base);
      project.tree = tree;
      const items: Record<string, ProjectItem> = {};
      this.flattenTree(project.tree, items);
      project.items = items;
      project.updatedAt = new Date().toISOString();
      this.saveProjects();
    }
  }

  private calculateProgressTree(node: ProjectTreeNode): any {
    if (!node) return null;
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

  private adjustTargets(project: Project, itemId: string, craftsDelta: number) {
    const recipe = this.recipesService.findOne(itemId);
    if (!recipe) return;

    // For each ingredient, compute how many units or crafts to adjust
    for (const ing of recipe.ingredients || []) {
      const childRecipe = this.recipesService.findOne(ing.itemId);
      const isRefund = craftsDelta < 0; // decreasing parent crafts increases required prereqs
      const absDelta = Math.abs(craftsDelta);

      if (childRecipe?.isBase) {
        const units = ing.quantity * absDelta;
        const item = project.items[ing.itemId];
        if (item) {
          const deltaUnits = isRefund ? units : -units;
          item.targetQuantity = Math.max(0, (item.targetQuantity ?? 0) + deltaUnits);
        }
      } else {
        const output = childRecipe?.output || 1;
        const childCrafts = Math.ceil((ing.quantity * absDelta) / output);
        const childItem = project.items[ing.itemId];
        if (childItem) {
          const deltaCrafts = isRefund ? childCrafts : -childCrafts;
          childItem.targetQuantity = Math.max(0, (childItem.targetQuantity ?? 0) + deltaCrafts);
        }
        // Cascade deeper along the tree across non-base ingredients
        if (childRecipe && !childRecipe.isBase && childCrafts !== 0) {
          this.adjustTargets(project, ing.itemId, isRefund ? -childCrafts : childCrafts);
        }
      }
    }
  }
}