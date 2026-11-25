import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAppealDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Appeal explanation must be between 20 and 1000 characters.' })
  @MaxLength(1000, { message: 'Appeal explanation must be between 20 and 1000 characters.' })
  explanation!: string;
}
