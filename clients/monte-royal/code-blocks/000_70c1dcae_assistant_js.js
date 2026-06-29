  const args = { _: [], csv: null, handles: null, apply: false, limit: null, resume: false, status: false, concurrency: 5 };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--resume') args.resume = true;
    else if (a === '--status') args.status = true;
    else if (a.startsWith('--csv=')) args.csv = a.slice(6);
    else if (a.startsWith('--handles=')) args.handles = a.slice(10);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8)) || null;
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.slice(14)) || 5;
    else args._.push(a);
  }
  return args;
}
