import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class DecideAppealDto {
  @IsString()
  @IsIn(['accept', 'reject'])
  decision!: 'accept' | 'reject';

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Decision note must be at least 10 characters.' })
  @MaxLength(1000, { message: 'Decision note cannot exceed 1000 characters.' })
  note!: string;
}
