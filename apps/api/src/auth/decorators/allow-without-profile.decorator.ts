import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_PROFILE_KEY = 'allowWithoutProfile';
export const AllowWithoutProfile = () => SetMetadata(ALLOW_WITHOUT_PROFILE_KEY, true);
