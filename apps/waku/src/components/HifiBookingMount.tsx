'use client';

import { useEffect } from 'react';
import { attachHifiBookingForms } from '@cf-bench/hifi-shell';

export function HifiBookingMount() {
  useEffect(() => {
    attachHifiBookingForms();
  }, []);
  return null;
}
