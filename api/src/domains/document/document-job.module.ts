import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { PermanentlyDeleteArchivedDocumentJob } from './jobs/permanently-delete-archived-document.job';
import { DocumentEntity } from './infra/persistence/entities/document.entity';

@Module({
  imports: [MikroOrmModule.forFeature([DocumentEntity])],
  providers: [PermanentlyDeleteArchivedDocumentJob],
  exports: [PermanentlyDeleteArchivedDocumentJob],
})
export class DocumentJobModule {}
