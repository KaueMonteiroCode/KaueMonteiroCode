/**
 * PONTO DE EXTENSÃO PARA SINCRONIZAÇÃO FUTURA — NÃO IMPLEMENTADO DE PROPÓSITO.
 *
 * A primeira versão é 100% local. Este contrato documenta como uma sincronização opcional
 * deve ser plugada sem comprometer a segurança:
 *
 * 1. Criptografia ponta a ponta no navegador (ex.: AES-GCM com chave derivada de uma frase
 *    secreta via PBKDF2/Argon2). O servidor só recebe blobs cifrados; nunca dados financeiros legíveis.
 * 2. O save já é um documento único versionado (`version`, `savedAt`) com IDs aleatórios por
 *    entidade (contas, lançamentos, itens), o que permite mesclar por entidade (last-writer-wins
 *    por `updatedAt`) sem colisão de IDs entre dispositivos.
 * 3. Lançamentos nunca são apagados fisicamente (`deleted` + `history`), então uma mesclagem
 *    não "ressuscita" nem perde dados silenciosamente.
 * 4. Moedas/XP são DERIVADOS do histórico financeiro, então não há saldo de moedas a sincronizar
 *    nem a ser duplicado por conflitos — basta sincronizar lançamentos e o livro de compras.
 * 5. Sincronização sempre opt-in, desligável, e com exportação/exclusão de dados disponíveis.
 */
import type { SaveData } from '../state/types';

export interface EncryptedBlob {
  /** versão do formato do blob */
  v: 1;
  iv: string; // base64
  salt: string; // base64
  data: string; // base64 (SaveData JSON cifrado)
  savedAt: number;
}

export interface SyncAdapter {
  /** Envia o estado já cifrado localmente. */
  push(blob: EncryptedBlob): Promise<void>;
  /** Busca o último estado remoto (cifrado) ou null. */
  pull(): Promise<EncryptedBlob | null>;
}

export interface SyncStrategy {
  /** Mescla dois saves (local e remoto já decifrados) por entidade. */
  merge(local: SaveData, remote: SaveData): SaveData;
}

/** Nenhum adaptador vem habilitado na v1. */
export const syncAdapter: SyncAdapter | null = null;
