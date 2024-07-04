import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateClientDTO } from './client.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientEntity } from './client.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(ClientEntity)
    private readonly clientRepository: Repository<ClientEntity>,
  ) {}

  async findOneOrFail(id: string): Promise<ClientEntity> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return client;
  }

  async findOneOrFailByToken(token: string): Promise<ClientEntity> {
    const client = await this.clientRepository.findOne({ where: { token } });
    if (!client) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return client;
  }

  async createOne(createClientDTO: CreateClientDTO): Promise<ClientEntity> {
    const newClient = new ClientEntity(createClientDTO);

    return this.clientRepository.save(newClient);
  }
}
