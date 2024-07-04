import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientService } from './client.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateClientDTO } from './client.dto';
import { AdminGuard } from '../../common/admin.guard';
import { Client } from './client.entity';

@ApiTags('clients')
@Controller('clients')
export class ClientController {
  constructor(private clientService: ClientService) {}

  @Post('')
  @ApiOperation({
    summary: 'Create a new Client',
    operationId: 'createClient',
  })
  @ApiBody({ type: CreateClientDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Client })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async createClient(
    @Req() req: Request,
    @Body() createClientDTO: CreateClientDTO,
    @Res() res: Response,
  ) {
    const newClient = await this.clientService.createOne(createClientDTO);

    res.status(HttpStatus.OK).json(newClient);
  }
}
