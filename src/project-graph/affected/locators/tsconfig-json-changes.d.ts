import { WholeFileChange } from '../../file-utils';
import { JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';
export declare const getTouchedProjectsFromTsConfig: TouchedProjectLocator<WholeFileChange | JsonChange>;
