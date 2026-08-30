import { Injectable } from '@nestjs/common';

@Injectable()
export class TeamsService {
  create(createTeamDto: any) {
    return 'This action adds a new team';
  }

  findOne(id: number) {
    return `This action returns a #${id} team`;
  }

  addMember(id: number, memberDto: any) {
    return `This action adds a member to team #${id}`;
  }
}
