import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from './config.js';

const VERIFY_TIMEOUT_MS = 5000;

const client = jwksClient({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: VERIFY_TIMEOUT_MS,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = await Promise.race<AuthUser>([
      new Promise<AuthUser>((resolve, reject) => {
        jwt.verify(
          token,
          getKey,
          {
            audience: config.auth0.audience,
            issuer: `https://${config.auth0.domain}/`,
            algorithms: ['RS256'],
          },
          (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded as AuthUser);
          }
        );
      }),
      new Promise<AuthUser>((_, reject) => {
        setTimeout(() => reject(new Error('JWT verification timeout')), VERIFY_TIMEOUT_MS);
      }),
    ]);
    
    request.user = decoded;
  } catch (error) {
    request.log.error({ error }, 'Auth token verification failed');
    reply.code(401).send({ error: 'Invalid token' });
    return;
  }
}
