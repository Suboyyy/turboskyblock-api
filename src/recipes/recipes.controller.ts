import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RecipesService, Recipe } from './recipes.service';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll() {
    return this.recipesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Body() recipe: Omit<Recipe, 'id'>) {
    return this.recipesService.create(recipe);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() recipe: Partial<Recipe>) {
    return this.recipesService.update(id, recipe);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.recipesService.delete(id);
  }

  @Get(':id/calculate')
  calculate(
    @Param('id') id: string,
    @Query('quantity') quantity: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    const depth = maxDepth ? parseInt(maxDepth) : Infinity;
    return this.recipesService.calculateBaseResources(id, parseInt(quantity), depth);
  }
}