import { ProjectsService, Project } from './projects.service';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    findAll(): Project[];
    findOne(id: string): Project;
    create(project: Omit<Project, 'id' | 'items' | 'createdAt' | 'updatedAt'>): Project;
    updateItem(projectId: string, itemId: string, quantity: number): Project;
    updateNodePossession(projectId: string, path: string[], currentQuantity: number): Project;
    updateNodeRequired(projectId: string, path: string[], quantity: number): Project;
    delete(id: string): boolean;
    getProgress(id: string): any;
}
