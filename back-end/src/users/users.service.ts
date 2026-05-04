import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository, User } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findAll(): User[] {
    return this.usersRepository.findAll();
  }

  findById(id: string): User {
    const user = this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  create(createUserDto: CreateUserDto): User {
    // Additional business logic could go here (e.g., checking if email already exists)
    console.log(`📝 Creating new user: ${createUserDto.name} (${createUserDto.email})`);
    return this.usersRepository.create(createUserDto);
  }

  update(id: string, updateUserDto: UpdateUserDto): User {
    const updatedUser = this.usersRepository.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return updatedUser;
  }

  delete(id: string): void {
    const isDeleted = this.usersRepository.delete(id);
    if (!isDeleted) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
  }
}
