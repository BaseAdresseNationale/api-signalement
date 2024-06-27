import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateClientDTO } from './client.dto';
import { Client } from './client.schema';

@Injectable()
export class ClientService {
  constructor(@InjectModel(Client.name) private clientModel: Model<Client>) {}

  async findOneOrFailByToken(token: string): Promise<Client> {
    const client = await this.clientModel.findOne({ token }).lean();
    if (!client) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return client;
  }

  async createOne(createClientDTO: CreateClientDTO): Promise<Client> {
    const newClient = await this.clientModel.create(createClientDTO);

    return newClient.toObject();
  }
}
