import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateClientDTO } from './client.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async findOneOrFail(id: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return client;
  }

  async findOneOrFailByToken(token: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: { token } });
    if (!client) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return client;
  }

  async createOne(createClientDTO: CreateClientDTO): Promise<Client> {
    const newClient = new Client(createClientDTO);

    return this.clientRepository.save(newClient);
  }
}
