import { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { query, queryOne, execute } from '../db.js';

interface User {
  id: number;
  auth0_id: string;
  email: string;
  display_name: string;
}

interface Strategy {
  id: number;
  user_id: number;
  name: string;
  cash_balance: number;
}

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Get or create current user
  fastify.get('/api/users/me', { preHandler: authenticate }, async (request, reply) => {
    const auth0Id = request.user!.sub;
    
    let user = await queryOne<User>(
      'SELECT * FROM users WHERE auth0_id = $1',
      [auth0Id]
    );
    
    if (!user) {
      // Create new user with placeholder - frontend should call POST to update
      const email = request.user!.email || '';
      const displayName = request.user!.name || email.split('@')[0] || 'New User';
      
      user = await queryOne<User>(
        `INSERT INTO users (auth0_id, email, display_name) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [auth0Id, email, displayName]
      );
    }
    
    return user;
  });

  // Create or update user with profile data from Auth0
  fastify.post('/api/users/me', { preHandler: authenticate }, async (request, reply) => {
    const auth0Id = request.user!.sub;
    const { email, displayName } = request.body as { email?: string; displayName?: string };
    
    let user = await queryOne<User>(
      'SELECT * FROM users WHERE auth0_id = $1',
      [auth0Id]
    );
    
    if (user) {
      // Update existing user if display_name is empty
      if (!user.display_name && displayName) {
        user = await queryOne<User>(
          `UPDATE users SET display_name = $1, email = COALESCE(NULLIF($2, ''), email), updated_at = NOW()
           WHERE auth0_id = $3
           RETURNING *`,
          [displayName, email || '', auth0Id]
        );
      }
    } else {
      // Create new user
      user = await queryOne<User>(
        `INSERT INTO users (auth0_id, email, display_name) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [auth0Id, email || '', displayName || 'New User']
      );
    }
    
    return user;
  });

  // Get user's strategies
  fastify.get('/api/users/me/strategies', { preHandler: authenticate }, async (request, reply) => {
    const auth0Id = request.user!.sub;
    
    const strategies = await query<Strategy>(
      `SELECT s.* FROM strategies s
       JOIN users u ON s.user_id = u.id
       WHERE u.auth0_id = $1
       ORDER BY s.name`,
      [auth0Id]
    );
    
    return strategies;
  });

  // Get all users (friends)
  fastify.get('/api/users', { preHandler: authenticate }, async (request, reply) => {
    const users = await query<User>(
      'SELECT id, display_name FROM users ORDER BY display_name'
    );
    return users;
  });

  // Get a friend's strategies (read-only)
  fastify.get<{ Params: { userId: string } }>(
    '/api/users/:userId/strategies',
    { preHandler: authenticate },
    async (request, reply) => {
      const userId = parseInt(request.params.userId);
      
      const strategies = await query<Strategy>(
        `SELECT id, user_id, name, cash_balance FROM strategies WHERE user_id = $1 ORDER BY name`,
        [userId]
      );
      
      return strategies;
    }
  );

  // Rename a strategy
  fastify.patch<{ Params: { strategyId: string } }>(
    '/api/strategies/:strategyId',
    { preHandler: authenticate },
    async (request, reply) => {
      const auth0Id = request.user!.sub;
      const strategyId = Number.parseInt(request.params.strategyId, 10);
      const { name } = request.body as { name?: string };

      if (!Number.isFinite(strategyId)) {
        return reply.code(400).send({ error: 'Invalid strategy ID' });
      }

      const trimmedName = name?.trim() ?? '';

      if (trimmedName.length === 0) {
        return reply.code(400).send({ error: 'Strategy name is required' });
      }

      if (trimmedName.length > 100) {
        return reply.code(400).send({ error: 'Strategy name must be 100 characters or less' });
      }

      // Verify ownership
      const strategy = await queryOne<Strategy>(
        `SELECT s.* FROM strategies s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND u.auth0_id = $2`,
        [strategyId, auth0Id]
      );

      if (!strategy) {
        return reply.code(403).send({ error: 'Strategy not found or access denied' });
      }

      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM strategies
         WHERE user_id = $1 AND name = $2 AND id <> $3`,
        [strategy.user_id, trimmedName, strategyId]
      );

      if (existing) {
        return reply.code(409).send({ error: 'Strategy name already in use' });
      }

      try {
        const updated = await queryOne<Strategy>(
          `UPDATE strategies SET name = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [trimmedName, strategyId]
        );

        return updated;
      } catch (err) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;

        if (code === '23505') {
          return reply.code(409).send({ error: 'Strategy name already in use' });
        }

        if (code === '22001' || code === '23514') {
          return reply.code(400).send({ error: 'Strategy name is invalid' });
        }

        request.log.error({ err }, 'Failed to rename strategy');
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // Update display name
  fastify.patch('/api/users/me', { preHandler: authenticate }, async (request, reply) => {
    const auth0Id = request.user!.sub;
    const { displayName } = request.body as { displayName: string };
    
    const user = await queryOne<User>(
      `UPDATE users SET display_name = $1, updated_at = NOW()
       WHERE auth0_id = $2
       RETURNING *`,
      [displayName, auth0Id]
    );
    
    return user;
  });
}
