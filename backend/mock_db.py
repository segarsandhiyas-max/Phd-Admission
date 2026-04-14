# Mock database for development when MongoDB connection fails
from datetime import datetime
from typing import Dict, List, Optional
import asyncio

class MockCollection:
    def __init__(self):
        self.data: Dict[str, dict] = {}
    
    async def find_one(self, query: dict) -> Optional[dict]:
        """Find one document matching the query"""
        for doc_id, doc in self.data.items():
            if self._matches_query(doc, query):
                return doc
        return None
    
    def _matches_query(self, doc: dict, query: dict) -> bool:
        """Check if document matches query with support for MongoDB operators"""
        for key, value in query.items():
            if isinstance(value, dict):
                # Handle MongoDB operators
                if "$in" in value:
                    if key not in doc or doc[key] not in value["$in"]:
                        return False
                elif "$ne" in value:
                    if key in doc and doc[key] == value["$ne"]:
                        return False
                elif "$gt" in value:
                    if key not in doc or doc[key] <= value["$gt"]:
                        return False
                elif "$gte" in value:
                    if key not in doc or doc[key] < value["$gte"]:
                        return False
                elif "$lt" in value:
                    if key not in doc or doc[key] >= value["$lt"]:
                        return False
                elif "$lte" in value:
                    if key not in doc or doc[key] > value["$lte"]:
                        return False
            else:
                if key not in doc or doc[key] != value:
                    return False
        return True
    
    async def insert_one(self, document: dict):
        """Insert a document"""
        doc_id = document.get("_id", str(len(self.data) + 1))
        self.data[doc_id] = document
        return type('InsertResult', (), {'inserted_id': doc_id})()
    
    def find(self, query: dict = None):
        """Find all documents matching the query"""
        if query is None or not query:
            return MockCursor(list(self.data.values()))
        
        results = []
        for doc in self.data.values():
            if self._matches_query(doc, query):
                results.append(doc)
        return MockCursor(results)
    
    def _matches_query(self, doc: dict, query: dict) -> bool:
        """Check if document matches query with support for MongoDB operators"""
        for key, value in query.items():
            if isinstance(value, dict):
                # Handle MongoDB operators
                if "$in" in value:
                    if key not in doc or doc[key] not in value["$in"]:
                        return False
                elif "$ne" in value:
                    if key in doc and doc[key] == value["$ne"]:
                        return False
                elif "$gt" in value:
                    if key not in doc or doc[key] <= value["$gt"]:
                        return False
                elif "$gte" in value:
                    if key not in doc or doc[key] < value["$gte"]:
                        return False
                elif "$lt" in value:
                    if key not in doc or doc[key] >= value["$lt"]:
                        return False
                elif "$lte" in value:
                    if key not in doc or doc[key] > value["$lte"]:
                        return False
            else:
                if key not in doc or doc[key] != value:
                    return False
        return True
    
    async def count_documents(self, query: dict = None) -> int:
        """Count documents matching the query"""
        if query is None or not query:
            return len(self.data)
        
        count = 0
        for doc in self.data.values():
            if self._matches_query(doc, query):
                count += 1
        return count
    
    async def update_one(self, query: dict, update: dict):
        """Update one document"""
        doc = await self.find_one(query)
        if doc:
            if "$set" in update:
                doc.update(update["$set"])
            if "$push" in update:
                for key, value in update["$push"].items():
                    if key not in doc:
                        doc[key] = []
                    doc[key].append(value)
            if "$pull" in update:
                for key, value in update["$pull"].items():
                    if key in doc and isinstance(doc[key], list):
                        doc[key] = [item for item in doc[key] if item != value]
            if "$inc" in update:
                for key, value in update["$inc"].items():
                    doc[key] = doc.get(key, 0) + value
        return type('UpdateResult', (), {'modified_count': 1 if doc else 0})()
    
    async def delete_one(self, query: dict):
        """Delete one document"""
        for doc_id, doc in list(self.data.items()):
            match = True
            for key, value in query.items():
                if key not in doc or doc[key] != value:
                    match = False
            if match:
                del self.data[doc_id]
                return type('DeleteResult', (), {'deleted_count': 1})()
        return type('DeleteResult', (), {'deleted_count': 0})()

class MockCursor:
    def __init__(self, data: List[dict]):
        self.data = data
        self.index = 0
        self._sort_field = None
        self._sort_direction = 1
    
    def sort(self, field: str, direction: int = 1):
        """Sort cursor results"""
        self._sort_field = field
        self._sort_direction = direction
        # Sort the data
        try:
            reverse = direction == -1
            self.data = sorted(self.data, key=lambda x: x.get(field, ''), reverse=reverse)
        except:
            pass  # If sorting fails, keep original order
        return self
    
    def limit(self, count: int):
        """Limit the number of results"""
        self.data = self.data[:count]
        return self
    
    def skip(self, count: int):
        """Skip a number of results"""
        self.data = self.data[count:]
        return self
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self.index >= len(self.data):
            raise StopAsyncIteration
        item = self.data[self.index]
        self.index += 1
        return item

class MockDatabase:
    def __init__(self):
        self.collections = {}
    
    def __getitem__(self, name: str):
        if name not in self.collections:
            self.collections[name] = MockCollection()
        return self.collections[name]
    
    async def command(self, cmd: str):
        """Mock database command"""
        return {"ok": 1}
