import type { EntityManager } from '@mikro-orm/postgresql';
import { UserEntity } from '../../../src/domains/user/infra/persistence/entities/user.entity';
import { TeamspaceAccessMode } from '../../../src/domains/teamspace/domain/enums/teamspace-access-mode.enum';
import { TeamspaceMemberEntity } from '../../../src/domains/teamspace/infra/persistence/entities/teamspace-member.entity';
import { TeamspaceEntity } from '../../../src/domains/teamspace/infra/persistence/entities/teamspace.entity';
import { WorkspaceEntity } from '../../../src/domains/workspace/infra/persistence/entities/workspace.entity';
import type { TeamspaceTemplate } from '../fixtures/realistic.types';
import type { SeedUserSummary } from './realistic-seed.types';

export async function upsertTeamspaces(
  em: EntityManager,
  workspaceId: string,
  templates: TeamspaceTemplate[],
): Promise<Map<string, TeamspaceEntity>> {
  const teamspacesByKey = new Map<string, TeamspaceEntity>();

  for (const template of templates) {
    let teamspace = await em.findOne(TeamspaceEntity, {
      workspace: workspaceId,
      name: template.name,
    });

    if (!teamspace) {
      teamspace = em.create(TeamspaceEntity, {
        workspace: em.getReference(WorkspaceEntity, workspaceId),
        name: template.name,
        description: template.description,
        accessMode: template.accessMode ?? TeamspaceAccessMode.OPEN,
      });
    }
    else {
      teamspace.description = template.description;
    }

    teamspace.accessMode = template.accessMode ?? TeamspaceAccessMode.OPEN;
    em.persist(teamspace);
    teamspacesByKey.set(template.key, teamspace);
  }

  await em.flush();

  return teamspacesByKey;
}

export async function upsertTeamspaceMembers(
  em: EntityManager,
  users: SeedUserSummary[],
  teamspacesByKey: Map<string, TeamspaceEntity>,
  templates: TeamspaceTemplate[],
): Promise<void> {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  for (const template of templates) {
    const teamspace = teamspacesByKey.get(template.key);

    if (!teamspace || !template.members || template.members.length === 0) {
      continue;
    }

    const memberUserIds = template.members.flatMap((member) => {
      const user = usersByEmail.get(member.email);

      return user ? [user.id] : [];
    });
    const existingMembers = memberUserIds.length > 0
      ? await em.find(TeamspaceMemberEntity, {
        teamspace: teamspace.id,
        user: { $in: memberUserIds },
      }, {
        populate: ['user'],
      })
      : [];
    const existingByUserId = new Map(existingMembers.map((member) => [member.user.id, member]));

    for (const member of template.members) {
      const user = usersByEmail.get(member.email);

      if (!user) {
        continue;
      }

      const existingMember = existingByUserId.get(user.id);
      const teamspaceMember = existingMember ??
        em.create(TeamspaceMemberEntity, {
          teamspace: em.getReference(TeamspaceEntity, teamspace.id),
          user: em.getReference(UserEntity, user.id),
          role: member.role,
        });

      teamspaceMember.role = member.role;
      em.persist(teamspaceMember);
    }
  }

  await em.flush();
}
