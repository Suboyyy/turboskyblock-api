import { Module } from '@nestjs/common';
import { RecipesModule } from './recipes/recipes.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [RecipesModule, ProjectsModule],
})
export class AppModule {}