'use client';

import React, { useState, createContext, useContext } from 'react';

// Context for search functionality
const SearchContext = createContext<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}>({
  searchQuery: '',
  setSearchQuery: () => {},
});

export const useSearch = () => useContext(SearchContext);

// Context for general UI state
const UIContext = createContext<{
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: (isOpen: boolean) => void;
}>({
  isMoreMenuOpen: false,
  setIsMoreMenuOpen: () => {},
});

export const useUI = () => useContext(UIContext);

export function LayoutStateProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <UIContext.Provider value={{ isMoreMenuOpen, setIsMoreMenuOpen }}>
        {children}
      </UIContext.Provider>
    </SearchContext.Provider>
  );
}
