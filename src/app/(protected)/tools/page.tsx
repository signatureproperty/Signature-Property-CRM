'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowRight, ClipboardList, Rocket, DollarSign, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const tools = [
    {
        title: 'List Generator',
        description: 'Create professional, WhatsApp-ready property lists for clients and dealers in one click.',
        href: '/tools/list-generator',
        icon: <ClipboardList className="h-6 w-6" />,
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        tag: "Productivity",
        isComingSoon: false,
    },
    {
        title: 'Find By Budget',
        description: 'Instantly match buyers with properties based on price range and area preferences.',
        href: '/tools/find-by-budget',
        icon: <DollarSign className="h-6 w-6" />,
        color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        tag: "Sales Tool",
        isComingSoon: false,
    },
    {
        title: 'Post Generator',
        description: 'AI-powered tool to automatically create engaging social media posts for your listings.',
        href: '/tools/post-generator',
        icon: <Rocket className="h-6 w-6" />,
        color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        tag: "Marketing",
        isComingSoon: true,
    }
]

export default function ToolsPage() {
  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight font-headline flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary fill-primary/20" /> Agency Tools
        </h1>
        <p className="text-muted-foreground font-medium text-lg max-w-2xl">
          Supercharge your workflow with these specialized real estate utilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tools.map((tool, index) => (
            <motion.div
                key={tool.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
            >
                <Card className="group relative h-full flex flex-col border-none shadow-xl bg-card/60 backdrop-blur-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
                    <div className={cn("absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-125 transition-transform duration-500 rotate-12")}>
                        {React.cloneElement(tool.icon as React.ReactElement, { className: "h-32 w-32" })}
                    </div>
                    
                    <CardHeader className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-3 rounded-2xl border transition-colors", tool.color)}>
                                {tool.icon}
                            </div>
                            <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest bg-muted/50 border-none">
                                {tool.tag}
                            </Badge>
                        </div>
                        <CardTitle className="text-2xl font-black font-headline tracking-tight group-hover:text-primary transition-colors">
                            {tool.title}
                        </CardTitle>
                        <CardDescription className="text-sm font-medium leading-relaxed pt-2 min-h-[4rem]">
                            {tool.description}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1" />

                    <CardFooter className="relative z-10 pt-4">
                        {tool.isComingSoon ? (
                            <div className="w-full p-4 rounded-2xl bg-muted/40 border border-dashed text-center">
                                <span className="text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
                                    <Sparkles className="h-3 w-3" /> Coming Soon
                                </span>
                            </div>
                        ) : (
                            <Button asChild className="w-full h-12 rounded-xl font-bold transition-all glowing-btn group/btn">
                                <Link href={tool.href}>
                                    Open {tool.title} 
                                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 p-8 rounded-[2.5rem] bg-gradient-to-br from-primary/5 to-blue-500/5 border border-primary/10 text-center"
      >
        <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-2">Pro Tip</p>
        <p className="text-muted-foreground font-medium">
            Use the <strong>List Generator</strong> to create daily inventory updates for your team and WhatsApp groups.
        </p>
      </motion.div>
    </div>
  );
}
