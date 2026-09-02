import type {
  Article,
  ArticleListItem,
  ArticleSummary,
  PaginatedData,
} from '@conit/types';
import { USER_ROLES } from '@conit/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiEnvelopeResponse,
  ApiErrorResponse,
  ApiPaginatedResponse,
} from '../common/dto/api-response.dto';
import { ArticlesService } from './articles.service';
import {
  ArticleListItemDto,
  ArticleResponseDto,
  ArticleSummaryDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';

@ApiTags('Knowledge base')
@ApiCookieAuth('conit_at')
@Roles(USER_ROLES.ADMIN)
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ResponseMessage('Articulos obtenidos correctamente')
  @ApiOperation({
    summary: 'Listar articulos',
    description: 'Listado paginado con busqueda en titulo, resumen y contenido.',
  })
  @ApiPaginatedResponse(ArticleListItemDto)
  findAll(@Query() query: ArticleQueryDto): Promise<PaginatedData<ArticleListItem>> {
    return this.articlesService.findAll(query);
  }

  @Get('summary')
  @ResponseMessage('Resumen obtenido correctamente')
  @ApiOperation({ summary: 'Resumen de la base de conocimiento' })
  @ApiEnvelopeResponse(ArticleSummaryDto)
  getSummary(): Promise<ArticleSummary> {
    return this.articlesService.getSummary();
  }

  @Get(':idOrSlug')
  @ResponseMessage('Articulo obtenido correctamente')
  @ApiOperation({
    summary: 'Obtener un articulo',
    description: 'Acepta el UUID o el identificador de URL. No cuenta como lectura.',
  })
  @ApiEnvelopeResponse(ArticleResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El articulo no existe.')
  findOne(@Param('idOrSlug') idOrSlug: string): Promise<Article> {
    return this.articlesService.findOne(idOrSlug);
  }

  @Post(':idOrSlug/views')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Lectura registrada')
  @ApiOperation({
    summary: 'Registrar una lectura',
    description:
      'Incrementa el contador de visitas. Va en su propia peticion para que abrir el editor no cuente como consulta.',
  })
  @ApiEnvelopeResponse(ArticleResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El articulo no existe.')
  view(@Param('idOrSlug') idOrSlug: string): Promise<Article> {
    return this.articlesService.view(idOrSlug);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Articulo creado correctamente')
  @ApiOperation({ summary: 'Crear un articulo' })
  @ApiEnvelopeResponse(ArticleResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe un articulo con ese identificador.')
  create(@Body() dto: CreateArticleDto, @CurrentUser('id') authorId: string): Promise<Article> {
    return this.articlesService.create(dto, authorId);
  }

  @Patch(':idOrSlug')
  @ResponseMessage('Articulo actualizado correctamente')
  @ApiOperation({ summary: 'Actualizar un articulo' })
  @ApiEnvelopeResponse(ArticleResponseDto)
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El articulo no existe.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Ya existe un articulo con ese identificador.')
  update(@Param('idOrSlug') idOrSlug: string, @Body() dto: UpdateArticleDto): Promise<Article> {
    return this.articlesService.update(idOrSlug, dto);
  }

  @Delete(':idOrSlug')
  @ResponseMessage('Articulo eliminado correctamente')
  @ApiOperation({ summary: 'Eliminar un articulo' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'El articulo no existe.')
  async remove(@Param('idOrSlug') idOrSlug: string): Promise<null> {
    await this.articlesService.remove(idOrSlug);

    return null;
  }
}
