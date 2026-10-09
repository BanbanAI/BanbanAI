import { Options } from '../docxTemplate';
import DocUtils from './docx-utils'

var relsFile = "_rels/.rels";
function getRelsTypes(zip, options?: Options) {
  var rootRels = zip.files[relsFile];
  var rootRelsXml = rootRels ? DocUtils.str2xml(rootRels?.asText(), options) : null;
  var rootRelationships = rootRelsXml ? rootRelsXml.getElementsByTagName("Relationship") : [];
  var relsTypes = {};
  for (var i = 0; i < rootRelationships.length; i++) {
    var relation = rootRelationships[i];
    relsTypes[relation.getAttribute("Target")] = relation.getAttribute("Type");
  }
  return relsTypes;
}
export default getRelsTypes