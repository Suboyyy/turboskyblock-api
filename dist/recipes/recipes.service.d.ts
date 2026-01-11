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
export declare class RecipesService {
    private readonly dataPath;
    private recipes;
    constructor();
    private loadRecipes;
    private saveRecipes;
    findAll(): Recipe[];
    findOne(id: string): Recipe;
    create(recipe: Omit<Recipe, 'id'>): Recipe;
    update(id: string, recipe: Partial<Recipe>): Recipe;
    delete(id: string): boolean;
    calculateBaseResources(recipeId: string, quantity: number, maxDepth?: number): any;
}
