import React from 'react'
import "@/assets/main.css";
import { useState } from 'react';
const ZenUI = () => {

  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  console.log("zen ui rendering")
  const handleSearch=(e:any)=>{
    e.preventDefault();
    // console.log(query)
    if(!query.trim()){
      setError("Please enter a search term!");
      return;
    }
    setError("");
    
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.location.href = searchUrl
  }
  return (
    <div className='fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-300'>
      <div className='flex flex-col bg-slate-200/80 rounded-full w-full px-4'></div>
       

      <form onSubmit={handleSearch} className='flex flex-col items-center gap-4'>
     <h1 className='text-6xl text-black mb-5'>🔍 Focus Mode Activated</h1>
      <input type='text' value={query} onChange={(e)=>setQuery(e.target.value)}
      placeholder='Search peacefully...'
      className='w-3/4 px-6 py-4 text-lg rounded-full border bg-slate-100 border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
      />
      <button type='submit' className='w-2/4 px-6 py-3 rounded-2xl bg-blue-500 text-white text-lg font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400'>Submit</button>
      </form>

   
    </div>
  )
}

export default ZenUI