import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import ndjson from 'ndjson';
import { BigQuery, TableSchema } from '@google-cloud/bigquery';
import dayjs from 'dayjs';

type LoadOptions = {
    table: string;
    schema: Record<string, any>[];
};

const client = new BigQuery();

const DATASET = 'FileUpload';

export const load = async (rows: Record<string, any>[], options: LoadOptions) => {
    const tableWriteStream = client
        .dataset(DATASET)
        .table(`p_${options.table}`)
        .createWriteStream({
            schema: {
                fields: [...options.schema, { name: '_batched_at', type: 'TIMESTAMP' }],
            } as TableSchema,
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            createDisposition: 'CREATE_IF_NEEDED',
            writeDisposition: 'WRITE_APPEND',
        });

    return pipeline(
        Readable.from(rows.map((row) => ({ ...row, _batched_at: dayjs().toISOString() }))),
        ndjson.stringify(),
        tableWriteStream,
    ).then(() => rows.length);
};
