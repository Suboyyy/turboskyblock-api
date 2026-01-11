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
exports.RecipesService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let RecipesService = class RecipesService {
    constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'recipes.json');
        this.recipes = [];
        this.loadRecipes();
    }
    loadRecipes() {
        try {
            if (!fs.existsSync(path.dirname(this.dataPath))) {
                fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
            }
            if (fs.existsSync(this.dataPath)) {
                const data = fs.readFileSync(this.dataPath, 'utf-8');
                this.recipes = JSON.parse(data);
            }
            else {
                this.recipes = [];
                this.saveRecipes();
            }
        }
        catch (error) {
            this.recipes = [];
        }
    }
    saveRecipes() {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.recipes, null, 2));
    }
    findAll() {
        return this.recipes;
    }
    findOne(id) {
        return this.recipes.find(r => r.id === id);
    }
    create(recipe) {
        const newRecipe = {
            ...recipe,
            id: Date.now().toString(),
        };
        this.recipes.push(newRecipe);
        this.saveRecipes();
        return newRecipe;
    }
    update(id, recipe) {
        const index = this.recipes.findIndex(r => r.id === id);
        if (index !== -1) {
            this.recipes[index] = { ...this.recipes[index], ...recipe };
            this.saveRecipes();
            return this.recipes[index];
        }
        return null;
    }
    delete(id) {
        const index = this.recipes.findIndex(r => r.id === id);
        if (index !== -1) {
            this.recipes.splice(index, 1);
            this.saveRecipes();
            return true;
        }
        return false;
    }
    calculateBaseResources(recipeId, quantity, maxDepth = Infinity) {
        const recipe = this.findOne(recipeId);
        if (!recipe)
            return null;
        const totalNeeded = Math.ceil(quantity / recipe.output);
        if (recipe.isBase || maxDepth <= 0) {
            return {
                itemId: recipeId,
                itemName: recipe.name,
                quantity: totalNeeded,
                isBase: true,
                children: [],
            };
        }
        const children = recipe.ingredients.map(ing => {
            const needed = ing.quantity * totalNeeded;
            return this.calculateBaseResources(ing.itemId, needed, maxDepth - 1);
        }).filter(Boolean);
        return {
            itemId: recipeId,
            itemName: recipe.name,
            quantity: totalNeeded,
            isBase: false,
            children,
        };
    }
};
exports.RecipesService = RecipesService;
exports.RecipesService = RecipesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RecipesService);
//# sourceMappingURL=recipes.service.js.map