import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  output: number;
  isBase?: boolean;
}

@Injectable()
export class RecipesService {
  private readonly dataPath = path.join(process.cwd(), 'data', 'recipes.json');
  private recipes: Recipe[] = [];

  constructor() {
    this.loadRecipes();
  }

  private loadRecipes() {
    try {
      if (!fs.existsSync(path.dirname(this.dataPath))) {
        fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
      }
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf-8');
        this.recipes = JSON.parse(data);
      } else {
        this.recipes = [];
        this.saveRecipes();
      }
    } catch (error) {
      this.recipes = [];
    }
  }

  private saveRecipes() {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.recipes, null, 2));
  }

  findAll(): Recipe[] {
    return this.recipes;
  }

  findOne(id: string): Recipe {
    return this.recipes.find(r => r.id === id);
  }

  create(recipe: Omit<Recipe, 'id'>): Recipe {
    const newRecipe: Recipe = {
      ...recipe,
      id: Date.now().toString(),
    };
    this.recipes.push(newRecipe);
    this.saveRecipes();
    return newRecipe;
  }

  update(id: string, recipe: Partial<Recipe>): Recipe {
    const index = this.recipes.findIndex(r => r.id === id);
    if (index !== -1) {
      this.recipes[index] = { ...this.recipes[index], ...recipe };
      this.saveRecipes();
      return this.recipes[index];
    }
    return null;
  }

  delete(id: string): boolean {
    const index = this.recipes.findIndex(r => r.id === id);
    if (index !== -1) {
      this.recipes.splice(index, 1);
      this.saveRecipes();
      return true;
    }
    return false;
  }

  // Calculer les ressources de base nécessaires récursivement
  calculateBaseResources(recipeId: string, quantity: number, maxDepth: number = Infinity): any {
    const recipe = this.findOne(recipeId);
    if (!recipe) return null;

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
}