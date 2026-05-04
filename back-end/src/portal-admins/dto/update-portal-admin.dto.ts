import { PartialType } from '@nestjs/swagger';
import { CreatePortalAdminDto } from './create-portal-admin.dto';

export class UpdatePortalAdminDto extends PartialType(CreatePortalAdminDto) {}
