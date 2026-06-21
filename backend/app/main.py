from __future__ import annotations
import os, json, uuid
from pathlib import Path
from urllib.parse import quote
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

load_dotenv()
ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT / 'data' / 'schemes.json'
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017')
MONGO_DB = os.getenv('MONGO_DB', 'sevasetu')

app=FastAPI(title='SevaSetu API',version='5.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

def get_db():
    client=MongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
    client.admin.command('ping')
    return client[MONGO_DB]

def load_file_schemes():
    if DATA_FILE.exists(): return json.loads(DATA_FILE.read_text(encoding='utf-8'))
    return []

def init_indexes(db):
    db.users.create_index('email', unique=False)
    db.saved_schemes.create_index([('userId',1),('scheme.id',1)], unique=False)
    db.schemes.create_index('id', unique=True, partialFilterExpression={'id': {'$type': 'string'}})

@app.on_event('startup')
def startup():
    try:
        db=get_db(); init_indexes(db)
        if db.schemes.count_documents({})==0:
            docs=load_file_schemes()
            if docs: db.schemes.insert_many(docs, ordered=False)
    except Exception as e:
        print('Mongo startup skipped:', e)

class AuthBody(BaseModel):
    name: Optional[str]=None
    email: str
    mobile: Optional[str]=None
    state: Optional[str]=None
    password: Optional[str]=None

class SaveBody(BaseModel):
    scheme: dict
    userId: Optional[str]='local-user'

@app.get('/')
def root(): return {'message':'SevaSetu API running'}

@app.get('/api/health')
def health():
    info={'status':'healthy','mongo':False,'schemes_file':len(load_file_schemes())}
    try:
        db=get_db(); info.update({'mongo':True,'schemes':db.schemes.count_documents({}),'saved_schemes':db.saved_schemes.count_documents({}),'users':db.users.count_documents({})})
    except Exception as e: info['mongo_error']=str(e)
    return info

@app.post('/api/auth/signup')
def signup(body:AuthBody):
    user=body.dict(); user['created_at']=datetime.utcnow().isoformat(); user['id']=user.get('email') or str(uuid.uuid4())
    try:
        db=get_db(); db.users.update_one({'email':user['email']},{'$set':user},upsert=True)
    except Exception: pass
    return {'success':True,'token':'local-dev-token','user':user}

@app.post('/api/auth/login')
def login(body:AuthBody):
    user={'name':body.name or 'Citizen','email':body.email,'mobile':body.mobile,'state':body.state}
    try:
        db=get_db(); found=db.users.find_one({'email':body.email},{'_id':0});
        if found: user.update(found)
    except Exception: pass
    return {'success':True,'token':'local-dev-token','user':user}

@app.get('/api/schemes')
def schemes(q: str='', limit:int=100, skip:int=0):
    try:
        db=get_db(); query={}
        if q: query={'$or':[{'title':{'$regex':q,'$options':'i'}},{'category':{'$regex':q,'$options':'i'}}]}
        docs=list(db.schemes.find(query,{'_id':0}).skip(skip).limit(limit))
        return {'success':True,'schemes':docs,'count':db.schemes.count_documents(query)}
    except Exception:
        data=load_file_schemes();
        if q: data=[x for x in data if q.lower() in json.dumps(x).lower()]
        return {'success':True,'schemes':data[skip:skip+limit],'count':len(data)}

@app.post('/api/saved-db')
def save_scheme(body:SaveBody):
    scheme=dict(body.scheme); scheme.setdefault('id', str(uuid.uuid4()))
    try:
        db=get_db(); db.saved_schemes.update_one({'userId':body.userId,'scheme.id':scheme['id']},{'$set':{'userId':body.userId,'scheme':scheme,'updated_at':datetime.utcnow().isoformat()}},upsert=True)
    except PyMongoError as e:
        raise HTTPException(500, str(e))
    return {'success':True,'message':'Scheme saved successfully','schemeId':scheme['id']}

@app.get('/api/saved-db')
def get_saved(userId: str='local-user'):
    try:
        db=get_db(); docs=list(db.saved_schemes.find({'userId':userId},{'_id':0}))
        return {'success':True,'saved':[d.get('scheme',d) for d in docs]}
    except Exception:
        return {'success':True,'saved':[]}

@app.delete('/api/saved-db/{scheme_id}')
def delete_saved(scheme_id: str, userId: str='local-user'):
    try:
        db=get_db(); db.saved_schemes.delete_many({'userId':userId,'scheme.id':scheme_id})
    except Exception: pass
    return {'success':True,'deleted':scheme_id}

@app.get('/api/scheme-official-link')
def official_link(title: str='', id: str=''):
    # Safe fallback; never invent fake myScheme slugs.
    return {'success':True,'mode':'search','officialLink':'https://www.myscheme.gov.in/search?keyword='+quote(title or id)}
