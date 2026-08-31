import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateProjectDto } from './create-project.dto';

/**
 * `clientId` queda fuera: mover un servicio de un cliente a otro arrastraria
 * sus tickets al historial de otra empresa.
 */
export class UpdateProjectDto extends PartialType(OmitType(CreateProjectDto, ['clientId'] as const)) {}
