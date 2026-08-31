import { PartialType } from '@nestjs/swagger';

import { CreateCategoryDto } from './create-category.dto';

/** Todos los campos son opcionales; solo se actualiza lo enviado. */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
