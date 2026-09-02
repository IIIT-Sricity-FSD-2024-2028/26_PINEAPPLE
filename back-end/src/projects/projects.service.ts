import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsRepository, Project } from './projects.repository';
import { CreateProjectDto, ProjectStatus } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  findAll(): Project[] {
    return this.projectsRepository.findAll();
  }

  findById(id: string): Project {
    const project = this.projectsRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    return project;
  }

  findByOwnerId(ownerId: string): Project[] {
    // Returns an array (which can be empty), so no NotFoundException is thrown here
    return this.projectsRepository.findByOwnerId(ownerId);
  }

  create(ownerId: string, createProjectDto: CreateProjectDto): Project {
    // Business Rule: A newly created project MUST always default to the 'Open' status
    console.log("Creating new project for user " + ownerId);
    return this.projectsRepository.create(ownerId, createProjectDto, ProjectStatus.Open);
  }

  update(id: string, updateProjectDto: UpdateProjectDto): Project {
    const updatedProject = this.projectsRepository.update(id, updateProjectDto);
    if (!updatedProject) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    return updatedProject;
  }

  delete(id: string): void {
    const isDeleted = this.projectsRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
  }
}
