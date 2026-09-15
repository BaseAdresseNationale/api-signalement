import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Report } from './report.entity';
import { PaginatedResult } from '../../common/dto/paginated-result.dto';
import { Author } from '../../common/schema/author.schema';
import { ReportStatusEnum } from '../../common/report-status.enum';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  // Retourne le code commune d'un report (signalement ou alert) par son id.
  // NB: pas de `select` restrictif ici — sur le repo base STI cela omettrait le
  // discriminateur et casserait les listeners @AfterLoad des entités enfant.
  async findCodeCommune(id: string): Promise<string | null> {
    const report = await this.reportRepository.findOne({ where: { id } });

    return report?.codeCommune ?? null;
  }

  async findMany(
    filters: {
      codeCommune?: any;
      source?: any;
      status?: any;
      type?: any;
    },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResult<Report>> {
    const where: Record<string, any> = {};

    if (filters.codeCommune) {
      where.codeCommune = filters.codeCommune;
    }
    if (filters.source) {
      where.source = { id: filters.source };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [data, total] = await this.reportRepository.findAndCount({
      where,
      relations: ['source', 'processedBy'],
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  /**
   * Traite les signalements et alertes créés il y a plus de `years` années.
   *
   * Un rapport encore en attente (statut PENDING) est expiré (statut EXPIRED)
   * puis anonymisé ; un rapport déjà clôturé est simplement anonymisé.
   *
   * Anonymisation : `firstName`, `lastName` et `email` sont supprimés. Seul le
   * domaine de l'email est conservé (champ `emailDomain`) afin de préserver la
   * possibilité de statistiques par type de déclarant. Un horodatage
   * `anonymizedAt` est ajouté pour garantir l'idempotence et la traçabilité.
   *
   * @returns le nombre de rapports traités
   */
  async expireAndAnonymizeReportsOlderThan(years: number): Promise<number> {
    const threshold = new Date();
    threshold.setFullYear(threshold.getFullYear() - years);

    const reports = await this.reportRepository
      .createQueryBuilder('report')
      .addSelect('report.author')
      .where('report.createdAt < :threshold', { threshold })
      .andWhere(
        new Brackets((qb) => {
          qb.where('report.status = :pendingStatus', {
            pendingStatus: ReportStatusEnum.PENDING,
          }).orWhere(
            "report.author IS NOT NULL AND report.author ->> 'anonymizedAt' IS NULL",
          );
        }),
      )
      .getMany();

    if (reports.length === 0) {
      return 0;
    }

    const anonymizedAt = new Date();

    for (const report of reports) {
      const updatePayload: Partial<Report> = {};

      if (report.author) {
        updatePayload.author = ReportService.anonymizeAuthor(
          report.author,
          anonymizedAt,
        );
      }

      if (report.status === ReportStatusEnum.PENDING) {
        updatePayload.status = ReportStatusEnum.EXPIRED;
      }

      await this.reportRepository.update(report.id, updatePayload);
    }

    return reports.length;
  }

  private static anonymizeAuthor(author: Author, anonymizedAt: Date): Author {
    const emailDomain = ReportService.extractEmailDomain(author?.email);

    return {
      ...(emailDomain ? { emailDomain } : {}),
      anonymizedAt,
    };
  }

  private static extractEmailDomain(email?: string): string | undefined {
    if (!email) {
      return undefined;
    }

    const atIndex = email.lastIndexOf('@');
    if (atIndex === -1) {
      return undefined;
    }

    return email.slice(atIndex + 1).toLowerCase() || undefined;
  }
}
