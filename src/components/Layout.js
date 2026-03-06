import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, title }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--jordyn-black)' }}>
      <Sidebar />
      <main className="jd-main fade-in">
        {title && (
          <div className="jd-page-header">
            <h2 className="jd-page-title">{title}</h2>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}