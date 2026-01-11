import { Controller, Get, Post, Delete, Body, Param, Put } from '@nestjs/common';
import { ProjectsService, Project } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() project: Omit<Project, 'id' | 'items' | 'createdAt' | 'updatedAt'>) {
    return this.projectsService.create(project);
  }

  @Put(':id/items/:itemId')
  updateItem(
    @Param('id') projectId: string,
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.projectsService.updateItemQuantity(projectId, itemId, quantity);
  }

  // Update a specific node in the tree by path
  @Put(':id/nodes')
  updateNodePossession(
    @Param('id') projectId: string,
    @Body('path') path: string[],
    @Body('currentQuantity') currentQuantity: number,
  ) {
    return this.projectsService.updateNodeOverride(projectId, path, currentQuantity);
  }

  // Update required quantity for a specific node (and cascade to its subtree)
  @Put(':id/nodes/required')
  updateNodeRequired(
    @Param('id') projectId: string,
    @Body('path') path: string[],
    @Body('quantity') quantity: number,
  ) {
    return this.projectsService.updateNodeRequired(projectId, path, quantity);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }

  @Get(':id/progress')
  getProgress(@Param('id') id: string) {
    return this.projectsService.getProgress(id);
  }
}
