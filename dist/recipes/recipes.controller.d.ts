import { RecipesService, Recipe } from './recipes.service';
export declare class RecipesController {
    private readonly recipesService;
    constructor(recipesService: RecipesService);
    findAll(): Recipe[];
    findOne(id: string): Recipe;
    create(recipe: Omit<Recipe, 'id'>): Recipe;
    update(id: string, recipe: Partial<Recipe>): Recipe;
    delete(id: string): boolean;
    calculate(id: string, quantity: string, maxDepth?: string): any;
}
