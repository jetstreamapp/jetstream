import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class SalesforceApi extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column({ nullable: true })
  groupName: string;

  @Column({ nullable: true })
  groupDescription: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  method: string;

  @Column({ nullable: true })
  url: string;

  @Column({ nullable: true })
  header: string;

  @Column({ nullable: true })
  body: string;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  static getAll() {
    return this.createQueryBuilder('salesforce_api').orderBy('salesforce_api.groupName').addOrderBy('salesforce_api.name').getMany();
  }
}
