import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from './config.js';

const client = jwksClient({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
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
    const decoded = await new Promise<AuthUser>((resolve, reject) => {
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
    });
    
    request.user = decoded;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid token' });
  }
}
