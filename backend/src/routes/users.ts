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
      // Create new user
      const email = request.user!.email || '';
      const displayName = request.user!.name || email.split('@')[0];
      
      user = await queryOne<User>(
        `INSERT INTO users (auth0_id, email, display_name) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [auth0Id, email, displayName]
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
      'SELECT id, display_name, email FROM users ORDER BY display_name'
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
