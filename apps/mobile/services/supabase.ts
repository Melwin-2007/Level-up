import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import aesjs from 'aes-js';

const ENCRYPTION_KEY_NAME = 'supabase_storage_aes_key';

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  try {
    let keyHex = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    if (!keyHex || keyHex.length !== 64) {
      const randomBytes = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 32; i += 1) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      keyHex = aesjs.utils.hex.fromBytes(randomBytes);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, keyHex);
    }
    return aesjs.utils.hex.toBytes(keyHex);
  } catch {
    // Fallback in environments without secure store (e.g. test environment)
    const fallbackKey = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      fallbackKey[i] = (i * 7 + 13) % 256;
    }
    return fallbackKey;
  }
}

export const encryptedStorageAdapter: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const encryptedHex = await AsyncStorage.getItem(key);
      if (!encryptedHex) {
        return null;
      }
      const encryptionKey = await getOrCreateEncryptionKey();
      const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);
      const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(5));
      const decryptedBytes = aesCtr.decrypt(encryptedBytes);
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const encryptionKey = await getOrCreateEncryptionKey();
      const textBytes = aesjs.utils.utf8.toBytes(value);
      const aesCtr = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(5));
      const encryptedBytes = aesCtr.encrypt(textBytes);
      const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
      await AsyncStorage.setItem(key, encryptedHex);
    } catch (error) {
      // In case of error writing encrypted value, do not crash
      console.warn('Failed to store session in encrypted storage', error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove item from storage', error);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: encryptedStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
