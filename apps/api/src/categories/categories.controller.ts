import type { CategoryWithCounts, PaginatedData } from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { CategoriesService } from './categories.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ResponseMessage('Categorias obtenidas correctamente')
  @ApiOperation({
    summary: 'Listar categorias',
    description: 'Listado paginado con busqueda por nombre y descripcion.',
  })
  @ApiPaginatedResponse(CategoryResponseDto)
  findAll(@Query() query: CategoryQueryDto): Promise<PaginatedData<CategoryWithCounts>> {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Categoria obtenida correctamente')
  @ApiOperation({ summary: 'Obtener una categoria' })
  @ApiEnvelopeResponse(CategoryResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La categoria no existe.')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CategoryWithCounts> {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Categoria creada correctamente')
  @ApiOperation({ summary: 'Crear una categoria' })
  @ApiEnvelopeResponse(CategoryResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe una categoria con ese nombre.')
  create(@Body() dto: CreateCategoryDto): Promise<CategoryWithCounts> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @ResponseMessage('Categoria actualizada correctamente')
  @ApiOperation({ summary: 'Actualizar una categoria' })
  @ApiEnvelopeResponse(CategoryResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La categoria no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe una categoria con ese nombre.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryWithCounts> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Categoria eliminada correctamente')
  @ApiOperation({
    summary: 'Eliminar una categoria',
    description: 'Solo si no tiene tickets asociados; en caso contrario, desactivala.',
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'La categoria no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'La categoria tiene tickets asociados.')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.categoriesService.remove(id);

    return null;
  }
}
