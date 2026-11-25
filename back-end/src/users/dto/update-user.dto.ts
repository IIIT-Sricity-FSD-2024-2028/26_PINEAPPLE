export {
  SelfUpdateUserDto,
  SelfUpdateUserDto as UpdateUserDto,
  SelfUpdateProfileDto,
  SELF_UPDATE_ALLOWED_TOP_FIELDS,
  SELF_UPDATE_ALLOWED_PROFILE_FIELDS,
  findDisallowedSelfUpdateFields,
} from './self-update-user.dto';

export type InternalUpdateUserInput = Record<string, any>;
