import React from 'react';
import { Bookmark, FileText, Grid3X3, LayoutDashboard, LogOut, Quote, ShieldCheck, User, ClipboardCheck } from 'lucide-react';
import { go } from '../App.jsx';
import Logo from './Logo.jsx';
export default function Shell({active,children,text}){text=text||{
dashboard:"Dashboard",
schemes:"Schemes",
documents:"Documents",
saved:"Saved Schemes",
profile:"Profile"
};let user={}; try{user=JSON.parse(localStorage.getItem('sevasetu_user')||'{}')}catch{} const nav=[['dashboard',text.dashboard,LayoutDashboard,'/app/dashboard'],['schemes',text.schemes,Grid3X3,'/app/schemes'],['documents',text.documents,FileText,'/app/documents'],['saved',text.saved,Bookmark,'/app/saved'],['applications','Applications',ClipboardCheck,'/app/applications'],['profile',text.profile,User,'/app/profile']]; return <div className="shell"><aside className="sidebar"><button onClick={()=>go('/')} className="shellLogo"><Logo dark/></button><nav>{nav.map(([k,l,I,p])=><button key={k} className={active===k?'active':''} onClick={()=>go(p)}><I/><span>{l}</span></button>)}</nav><div className="quote"><Quote/><p>“Empowering citizens through simple, trusted and accessible digital public services.”</p><span>Digital India Inspired</span></div><div className="sideUser"><div className="avatar">{(user.name||'K')[0]}</div><div><b>{user.name||'Khushi'}</b><small>{user.email||'Citizen Account'}</small></div><button onClick={()=>{localStorage.removeItem('sevasetu_token');go('/login')}}><LogOut/></button></div></aside><main className="shellMain"><header><span><ShieldCheck/>SevaSetu Citizen Portal</span><h2>{nav.find(n=>n[0]===active)?.[1]||'Dashboard'}</h2></header><section>{children}</section></main></div>}
