import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateClientDTO } from './client.dto';
import { Client } from './client.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ClientService {
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Client.name) private clientModel: Model<Client>,
  ) {}

  async findOneOrFailByToken(token: string): Promise<Client> {
    const isAPIDepotToken = token.length > 32;
    if (isAPIDepotToken) {
      return this.findOneOrFailFromAPIDepot(token);
    } else {
      const client = await this.clientModel.findOne({ token }).lean();
      if (!client) {
        throw new Error('Client not found');
      }

      return client;
    }
  }

  async findOneOrFailFromAPIDepot(token: string): Promise<Client> {
    const decodedToken = Buffer.from(token, 'base64').toString();
    const [clientId, clientToken] = decodedToken.split(':');
    const { data: client } = await firstValueFrom(
      this.httpService.get(`/clients/${clientId}`),
    );

    if (client?.token !== clientToken) {
      throw new Error('Client not found');
    }

    return client;
  }

  async createOne(createClientDTO: CreateClientDTO): Promise<Client> {
    const newClient = await this.clientModel.create(createClientDTO);

    return newClient.toObject();
  }
}
