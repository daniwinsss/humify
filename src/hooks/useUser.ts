"use client";

import { useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  name: string;
}

let cachedUser: User | null = null;
let cachePromise: Promise<User | null> | null = null;

function fetchUser(): Promise<User | null> {
  if (cachePromise) return cachePromise;
  cachePromise = fetch("/api/auth/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cachedUser = data?.user ?? null;
      return cachedUser;
    })
    .catch(() => null);
  return cachePromise;
}

export function clearUserCache() {
  cachedUser = null;
  cachePromise = null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) return;
    fetchUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
