# 🚀 Deployment Guide - Vercel

## Prerequisites
- GitHub account connected to Vercel
- Supabase project created
- API keys ready (Hugging Face, NVIDIA)

---

## Step-by-Step Deployment

### 1. Push Code to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "feat: Ready for production deployment"

# Push to GitHub
git push origin feature/new-feature

# Merge to main (or create PR on GitHub)
git checkout main
git merge feature/new-feature
git push origin main
```

---

### 2. Import Project to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository: `JetsadaSomporn/Demand-Forecasting-Fashion`
4. Framework Preset: **Next.js** (auto-detected)
5. Root Directory: `./`
6. Build Command: `npm run build`
7. Output Directory: `.next`

---

### 3. Configure Environment Variables

**REQUIRED** - Add these in Vercel Dashboard → Settings → Environment Variables:

#### Supabase (Required)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key
```

#### AI Services (Optional - will use fallback if not set)
```
HF_TOKEN=hf_your_huggingface_token_here
NVIDIA_API_KEY=nvapi-your_nvidia_api_key_here
```

#### Forecast Microservice (Required for production forecasts)
```
FORECAST_SERVICE_URL=https://your-hf-space-or-service
NEXT_PUBLIC_FORECAST_SERVICE_URL=https://your-hf-space-or-service
# FORECAST_SERVICE_TOKEN=optional_bearer_token_if_required
```

#### App Configuration (Optional)
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important:** 
- Set all variables for **Production**, **Preview**, and **Development** environments
- Click "Save" after adding each variable

---

### 4. Deploy

Click **"Deploy"** button - Vercel will:
1. ✅ Clone your repository
2. ✅ Install Node.js dependencies (`npm install`)
3. ✅ Build Next.js app (`npm run build`)
4. ✅ Deploy to production URL

**Build Time:** ~3-5 minutes

---

### 5. Post-Deployment Checks

After deployment succeeds:

#### ✅ Test Core Features
- [ ] Homepage loads correctly
- [ ] Navigation works (Forecast, History, Settings)
- [ ] Authentication works (Magic Link login)
- [ ] Forecast API responds (`/api/forecast`)
- [ ] Image extraction API works (`/api/extract-meta`)
- [ ] Remote forecast service returns predictions
- [ ] Database saves forecasts correctly

#### 🔍 Check Logs
- Go to Vercel Dashboard → Project → Logs
- Ensure calls to the forecast microservice succeed (HTTP 200)
- Remote service cold starts (e.g. Hugging Face Space) may take 5-10s on first run

---

### 6. Configure Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain (e.g., `forecast.yourdomain.com`)
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` environment variable

---

## 🐛 Troubleshooting

### Forecast Microservice
**Problem:** Forecast API returns `spawn python3 ENOENT` or similar  
**Solution:** 
- Ensure `FORECAST_SERVICE_URL` (and optional token) are set in Vercel
- Verify external service is reachable and returning JSON
- Re-deploy after updating environment variables

### Environment Variables
**Problem:** API calls fail  
**Solution:**
- Verify all env vars are set correctly
- Check spelling (case-sensitive)
- Redeploy after adding new variables

### Build Failures
**Problem:** Build fails  
**Solution:**
```bash
# Test build locally first
npm run build

# Check for TypeScript errors
npm run type-check

# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Cold Starts
**Problem:** First request slow  
**Solution:**
- Normal for serverless (5-10s)
- Subsequent requests are fast (~1-2s)
- Consider Vercel Pro for faster cold starts

---

## 📊 Expected Performance

| Feature | Response Time |
|---------|--------------|
| Static pages | < 1s |
| API routes (warm) | 1-3s |
| Python inference (warm) | 2-5s |
| Python inference (cold) | 5-15s |
| Image extraction | 3-8s |

---

## 🔐 Security Checklist

- [x] `.env` files in `.gitignore`
- [x] Supabase RLS policies enabled
- [x] API keys stored in Vercel env vars (not in code)
- [x] CORS configured properly
- [x] Rate limiting enabled (Vercel default)

---

## 📈 Monitoring

### Vercel Analytics (Built-in)
- Real-time visitor tracking
- Performance metrics
- Error tracking

### Supabase Dashboard
- Database activity
- Query performance
- Storage usage

### Application Logs
```bash
# View real-time logs
vercel logs --follow

# View specific deployment
vercel logs [deployment-url]
```

---

## 🎉 Success!

Your app is live at: `https://your-project.vercel.app`

**Next Steps:**
1. Share the URL with users
2. Monitor initial usage
3. Set up custom domain
4. Add monitoring/analytics
5. Create backup/restore procedures

---

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs

**Issues?**
- Check Vercel deployment logs
- Review Supabase database logs
- Test API routes individually
- Verify environment variables

---

**Generated:** $(date)  
**Repository:** JetsadaSomporn/Demand-Forecasting-Fashion  
**Stack:** Next.js 15 + Python + LightGBM + Supabase
