import { RecipesService } from '../recipes/recipes.service';
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
    nodeOverrides?: Record<string, {
        craftsDone?: number;
        currentQuantityOverride?: number;
    }>;
    tree?: ProjectTreeNode;
    createdAt: string;
    updatedAt: string;
}
export declare class ProjectsService {
    private readonly recipesService;
    private readonly dataPath;
    private projects;
    constructor(recipesService: RecipesService);
    private loadProjects;
    private saveProjects;
    findAll(): Project[];
    findOne(id: string): Project;
    create(projectData: Omit<Project, 'id' | 'items' | 'createdAt' | 'updatedAt' | 'tree' | 'nodeOverrides'>): Project;
    private convertToProjectTree;
    private flattenTree;
    updateItemQuantity(projectId: string, itemId: string, quantity: number): Project;
    updateNodeOverride(projectId: string, path: string[], currentQuantity?: number): Project;
    delete(id: string): boolean;
    updateNodeRequired(projectId: string, path: string[], quantity: number): Project;
    private recalcSubtreeByParentPossession;
    private clampPossessionToRequired;
    private mergePreserveBaseline;
    private findNodeByPath;
    getProgress(projectId: string): any;
    private ensureProjectTree;
    private calculateProgressTree;
    private adjustTargets;
}
