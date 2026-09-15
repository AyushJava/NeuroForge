import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-[150px]" />
        
        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 leading-[1.1]"
          >
            Enterprise Software Lifecycle
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
          >
            and DevOps Management System
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Modern enterprise software powered by Artificial Intelligence. 
            Plan, build, test, and ship with an intelligent co-pilot watching over every step of your development lifecycle.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all hover:-translate-y-0.5"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-card/50 backdrop-blur-sm border border-border text-white font-medium rounded-xl hover:bg-card hover:border-primary/50 transition-all"
            >
              Learn More
            </a>
          </motion.div>
        </div>
      </div>

      {/* Floating Mockups (Decorative) */}
      <motion.div 
        animate={{ y: [0, -10, 0] }} 
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="hidden lg:block absolute left-[5%] top-[25%] w-64 h-40 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl p-4 rotate-[-6deg]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20" />
          <div className="h-3 w-24 bg-white/20 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/10 rounded-full" />
          <div className="h-2 w-4/5 bg-white/10 rounded-full" />
          <div className="h-2 w-full bg-white/10 rounded-full" />
        </div>
      </motion.div>

      <motion.div 
        animate={{ y: [0, 10, 0] }} 
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
        className="hidden lg:block absolute right-[5%] bottom-[25%] w-72 h-48 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-xl shadow-[0_0_40px_rgba(37,99,235,0.15)] p-5 rotate-[4deg]"
      >
        <div className="flex justify-between items-end mb-4">
          <div className="h-16 w-8 bg-primary/40 rounded-t-sm" />
          <div className="h-24 w-8 bg-primary/60 rounded-t-sm" />
          <div className="h-20 w-8 bg-primary/80 rounded-t-sm" />
          <div className="h-32 w-8 bg-primary rounded-t-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]" />
          <div className="h-28 w-8 bg-primary/60 rounded-t-sm" />
        </div>
        <div className="h-1 w-full bg-white/10 rounded-full mb-3" />
        <div className="h-3 w-1/2 bg-white/20 rounded-full" />
      </motion.div>
    </section>
  );
}