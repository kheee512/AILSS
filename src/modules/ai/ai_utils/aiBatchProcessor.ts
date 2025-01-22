import { Notice } from 'obsidian';

export class AIBatchProcessor {
    static async processBatch<T, R>(
        items: T[],
        processor: (item: T, index: number, total: number) => Promise<R>,
        batchSize: number = 3,
        progressMessage: string = '처리 중'
    ): Promise<R[]> {
        const results: R[] = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            new Notice(`${progressMessage}... (${i + 1}-${Math.min(i + batchSize, items.length)}/${items.length})`);
            
            const batchResults = await Promise.all(
                batch.map(async (item, index) => {
                    //console.log(`${progressMessage} (${i + index + 1}/${items.length})`);
                    new Notice(`${progressMessage} (${i + index + 1}/${items.length})`);
                    const result = await processor(item, i + index, items.length);
                    return result;
                })
            );
            
            results.push(...batchResults);
            
            if (i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }
}